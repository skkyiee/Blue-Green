pipeline {
    agent any // Must be a Windows agent

    environment {
        BLUE_PORT    = 8081
        GREEN_PORT   = 8082
        // CHANGE THIS to your Docker Hub username/repo
        IMAGE_NAME   = "skkyiee/node-blue-green"
        NGINX_PATH   = "C:\\nginx-1.28.0" // Your NGINX install directory
        NGINX_CONFIG = "C:\\nginx-1.28.0\\conf\\live-upstream.conf" // The file to overwrite
    }

    stages {
        stage('1. Build & Push Docker Image') {
            steps {
                script {
                    env.IMAGE_TAG = "${env.BUILD_NUMBER}"
                    def dockerImage = "${IMAGE_NAME}:${IMAGE_TAG}"
                    
                    echo "Building Docker image: ${dockerImage}"
                    bat "docker build -t ${dockerImage} ."
                    
                    // CHANGE THIS 'dockerHubCredentialsId' to your Jenkins credential ID
                    withCredentials([usernamePassword(credentialsId: 'dockerHubCredentialsId', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        bat "docker login -u ${DOCKER_USER} -p ${DOCKER_PASS}"
                        bat "docker push ${dockerImage}"
                        bat "docker logout"
                    }
                }
            }
        }

        stage('2. Determine Idle Environment') {
            steps {
                script {
                    // Check NGINX config to see which port is "live"
                    def liveConfig = bat(script: "type ${env.NGINX_CONFIG}", returnStdout: true).trim()
                    
                    if (liveConfig.contains("${BLUE_PORT}")) {
                        // BLUE is LIVE, so GREEN is IDLE
                        env.IDLE_ENV_NAME  = "green"
                        env.IDLE_PORT      = env.GREEN_PORT
                        env.IDLE_COLOR     = "Green"
                        env.LIVE_ENV_NAME  = "blue"
                    } else {
                        // GREEN is LIVE, so BLUE is IDLE
                        env.IDLE_ENV_NAME  = "blue"
                        env.IDLE_PORT      = env.BLUE_PORT
                        env.IDLE_COLOR     = "Blue"
                        env.LIVE_ENV_NAME  = "green"
                    }
                    echo "LIVE environment: ${env.LIVE_ENV_NAME}"
                    echo "Deploying new version to IDLE environment: ${env.IDLE_ENV_NAME} on port ${env.IDLE_PORT}"
                }
            }
        }

        stage('3. Deploy to Idle Environment') {
            steps {
                script {
                    def dockerImage = "${IMAGE_NAME}:${IMAGE_TAG}"
                    
                    // Stop and remove any old container in the idle slot
                    // "|| echo" prevents the pipeline from failing if the container doesn't exist
                    bat "docker stop ${env.IDLE_ENV_NAME} || echo 'container not found'"
                    bat "docker rm ${env.IDLE_ENV_NAME} || echo 'container not found'"
                    
                    // Run the new container in the idle slot
                    echo "Starting new ${env.IDLE_ENV_NAME} container..."
                    // The ^ character is the line-continuation for Windows batch
                    bat """
                    docker run -d --name ${env.IDLE_ENV_NAME} ^
                        -p ${env.IDLE_PORT}:3000 ^
                        -e APP_COLOR=${env.IDLE_COLOR} ^
                        ${dockerImage}
                    """
                }
            }
        }

        stage('4. Test Idle Environment') {
            steps {
                echo "Testing new deployment on port ${env.IDLE_PORT}..."
                
                // Use 'timeout' instead of 'sleep'
                bat "timeout /t 10 /nobreak" // Wait 10 seconds for container to start
                
                // Use 'curl' (assuming it's in your Windows PATH)
                bat "curl -f http://localhost:${env.IDLE_PORT}/"
            }
        }

        stage('5. Promote: Switch Traffic') {
            // This 'input' step makes the switch manual. Jenkins will pause here.
            input "Deployment to ${env.IDLE_ENV_NAME} passed testing. Switch live traffic?"
            
            steps {
                echo "Switching NGINX to point to ${env.IDLE_ENV_NAME} on port ${env.IDLE_PORT}"
                
                // Create the new NGINX config fragment
                def newUpstreamConfig = "upstream live_app { server 127.0.0.1:${env.IDLE_PORT}; }"
                
                // Overwrite the NGINX config file
                bat "echo ${newUpstreamConfig} > ${env.NGINX_CONFIG}"
                
                // Reload NGINX to apply changes
                // We must 'cd' to the NGINX directory to run the command
                bat "cd ${env.NGINX_PATH} && nginx.exe -s reload"
                
                echo "Traffic successfully switched to ${env.IDLE_ENV_NAME}."
            }
        }

        stage('6. Cleanup Old Live Environment') {
            steps {
                // This stage stops the container that is no longer receiving traffic
                echo "Stopping old ${env.LIVE_ENV_NAME} container..."
                bat "docker stop ${env.LIVE_ENV_NAME} || echo 'container not found'"
                bat "docker rm ${env.LIVE_ENV_NAME} || echo 'container not found'"
            }
        }
    }
}
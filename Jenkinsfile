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
                    
                    // --- START FIX ---
                    // We use try-catch because the container might not exist,
                    // and we don't want that to fail the build.
                    
                    try {
                        echo "Attempting to stop old ${env.IDLE_ENV_NAME} container..."
                        bat "docker stop ${env.IDLE_ENV_NAME}"
                    } catch (e) {
                        echo "Container ${env.IDLE_ENV_NAME} was not running. This is normal."
                    }
                    
                    try {
                        echo "Attempting to remove old ${env.IDLE_ENV_NAME} container..."
                        bat "docker rm ${env.IDLE_ENV_NAME}"
                    } catch (e) {
                        echo "Container ${env.IDLE_ENV_NAME} did not exist. This is normal."
                    }
                    // --- END FIX ---
                    
                    
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
                
                // FIX: Use the 'sleep' step instead of 'timeout'
                echo "Waiting 10 seconds for container to start..."
                sleep time: 10, unit: 'SECONDS'
                
                // Use 'curl' (assuming it's in your Windows PATH)
                echo "Running curl test..."
                bat "curl -f http://localhost:${env.IDLE_PORT}/"
            }
        }

        stage('5. Promote: Switch Traffic') {
            steps {
                input message: "Deployment to ${env.IDLE_ENV_NAME} passed testing. Switch live traffic?"
                
                echo "Switching NGINX to point to ${env.IDLE_ENV_NAME} on port ${env.IDLE_PORT}"

                script {
                    // Create the new NGINX config fragment
                    def newUpstreamConfig = "upstream live_app { server 127.0.0.1:${env.IDLE_PORT}; }"
                    
                    // Overwrite the NGINX config file
                    bat "echo ${newUpstreamConfig} > ${env.NGINX_CONFIG}"
                    
                    // --- START FIX ---
                    // Try to reload NGINX. If it fails (e.g., not running), start it.
                    try {
                        echo "Attempting to reload NGINX..."
                        bat "cd ${env.NGINX_PATH} && nginx.exe -s reload"
                    } catch (e) {
                        echo "Reload failed. Assuming NGINX is not running. Attempting to start..."
                        // Use "start nginx.exe" to launch it in the background
                        bat "cd ${env.NGINX_PATH} && start nginx.exe"
                    }
                    // --- END FIX ---
                }
                
                echo "Traffic successfully switched to ${env.IDLE_ENV_NAME}."
            }
        }

        stage('6. Cleanup Old Live Environment') {
            steps {
                script {
                    echo "Stopping old ${env.LIVE_ENV_NAME} container..."
                    
                    try {
                        bat "docker stop ${env.LIVE_ENV_NAME}"
                    } catch (e) {
                        echo "Container ${env.LIVE_ENV_NAME} was not running. This is normal."
                    }
                    
                    try {
                        echo "Attempting to remove old ${env.LIVE_ENV_NAME} container..."
                        bat "docker rm ${env.LIVE_ENV_NAME}"
                    } catch (e) {
                        echo "Container ${env.LIVE_ENV_NAME} did not exist. This is normal."
                    }
                }
            }
        }
    }
}
# =====================================================================
# TrustVault — Multi-Stage Production Dockerfile
# =====================================================================

# Stage 1: Build stage
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copy Maven POM and pre-fetch dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy application source code and compile
COPY src ./src
RUN mvn clean package -DskipTests -B

# Stage 2: Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Create unprivileged application user for container security
RUN addgroup -S trustvault && adduser -S trustvault -G trustvault

# Create upload directory with correct ownership
RUN mkdir -p /app/storage/uploads && chown -R trustvault:trustvault /app

USER trustvault

# Copy built executable JAR from build stage
COPY --from=build /app/target/trustvault-1.0.0.jar app.jar

EXPOSE 8080

ENV SPRING_PROFILES_ACTIVE=mysql \
    JAVA_OPTS="-XX:+UseG1GC -XX:MaxRAMPercentage=75.0"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]

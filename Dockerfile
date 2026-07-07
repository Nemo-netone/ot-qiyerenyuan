FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace/hrm
COPY hrm/pom.xml .
COPY hrm/src ./src
RUN mvn -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
ENV SERVER_PORT=8888
ENV FILE_UPLOAD_PATH=/tmp/hrm-files/
RUN mkdir -p /tmp/hrm-files
COPY --from=build /workspace/hrm/target/hrm-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8888
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

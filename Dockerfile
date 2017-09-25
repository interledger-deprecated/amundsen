FROM node
RUN apt-get update
RUN apt-get install -yq vim git
ADD . /app
WORKDIR /app
RUN npm install
EXPOSE 80
EXPOSE 443
CMD npm start

# create a docker file for simple nodejs server
FROM node:24

# set the working directory
WORKDIR /usr/src/app

# copy package.json and package-lock.json
COPY package*.json ./

# install dependencies
RUN npm install

# copy the rest of the application code
COPY . .

# expose the application port
EXPOSE 5000

# start the application
CMD ["npm", "start"]
const VERSION = "0.1.1";

const createClient = require('webdav');
const fs = require('fs');
const yaml = require("js-yaml");
const express = require("express");
const path = require("path");
const {green, red, white, yellow} = require("./messages");

const app = express();

app.set('view engine', 'ejs');

let config = {};
let fileCounter = 0;
const startTime = new Date().toLocaleString();

getConfigOptions();

const {url, username, password, timeout, folder, target, port, removeFromCloud} = config;
const client = createClient(url, username, password);

app.listen(port, () => white(`Web UI started. Go to localhost:${port} to check status`));

green("WebDAV watcher started");
yellow(`Running task every ${timeout} seconds`);
yellow(`Images will be copied to ${target} folder`);
removeFromCloud
    ? red("Remote images will be deleted")
    : red("Remote images will be left intact");
white("======================================");

getFiles();

app.get("/", (req, res) => res.render(path.join(__dirname, 'status.ejs'), {
    ...config,
    fileCounter,
    startTime, VERSION
}));

setInterval(getFiles, timeout * 1000);

function getConfigOptions() {
    try {
        // testconfig.yaml can be used to store your actual login/pass and other settings for development purposes
        config = yaml.safeLoad(fs.readFileSync('./testconfig.yaml', 'utf8'));
    } catch (error) {
        try {
            config = yaml.safeLoad(fs.readFileSync('./config.yaml', 'utf8'));
        } catch (error) {
            red("Config file not found, will crash now. Good bye");
        }
    }
}

async function getFiles() {
    let files = [];
    try {
        files = await client.getDirectoryContents(folder);
    } catch (e) {
        red("There's a problem accessing remote. Make sure your 'folder' option in config.yaml is correct");
        return
    }
    if (files.length < 2) return yellow(`No more job. Sleeping for ${timeout} seconds`);

    const local = fs.readdirSync(target) || [];
    white(`Total images in remote folder: ${files.length - 1}`);
    files = files.filter(f => !local.includes(f.basename)).slice(1);
    // Ignore file if already downloaded. Ignore 1st element — it's a folder
    white(`New images in remote folder ${files.length}. Will copy to ${target}`);

    files.forEach(file => {
        client.getFileContents(file.filename)
            .then(content => {
                green(`Copying file ${file.basename}`);
                fileCounter++;
                fs.writeFile(target + file.basename, content, error => {
                    if (error) {
                        white(error);
                    } else {
                        if (removeFromCloud) {
                            client.deleteFile(file.filename);
                            red(`Deleting file ${file.basename}`);
                        }
                    }
                });
            })
            .catch(error => white(error))
    });
    yellow(`All jobs set. No more jobs. Sleeping for ${timeout} seconds`);
}




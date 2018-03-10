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

getFiles();

async function getFiles() {
    const files = await client.getDirectoryContents(folder);
    if (files.length < 2) return;
    const local = fs.readdirSync(target) || [];
    white(`Images in remote folder: ${files.length - 1}`);
    await files
        .filter(f => !local.includes(f.basename))
        .forEach((file, index) => {
            if (!index) return; // skip folder at index 0
            client.getFileContents(file.filename)
                .then(content => {
                    green(`Copying file ${file.basename}`);
                    fileCounter++;
                    fs.writeFile(target + file.basename, content, error => {
                        if (error) {
                            white(error)
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
    yellow(`No more job. Sleeping for ${timeout} seconds`);
}

app.get("/", (req, res) => res.render(path.join(__dirname, 'status.ejs'), {
    ...config,
    fileCounter,
    startTime, VERSION
}));

setInterval(getFiles, timeout * 1000);

function getConfigOptions() {
    try {
        config = yaml.safeLoad(fs.readFileSync('./testconfig.yaml', 'utf8'));
    } catch (error) {
        try {
            config = yaml.safeLoad(fs.readFileSync('./config.yaml', 'utf8'));
        } catch (error) {
            red("Config file not found, will crash now. Good bye");
        }
    }
}




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
let ignoredFiles = [];

const startTime = new Date().toLocaleString();

getConfigOptions();
getIgnoredFilesList();

const {url, username, password, timeout, folder, target, port, removeFromCloud, ignoreDeleted, ignore} = config;
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
    startTime
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

function getIgnoredFilesList() {
    try {
        ignoredFiles = fs.readFileSync(target + `/${ignore}`).slice("\n");
    }
    catch (error) {
        ignoredFiles = [];
        red(error)
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
    if (files.length < 2) {
        return yellow(`Nothing to do. Sleeping for ${timeout} seconds`);
    }

    const local = fs.readdirSync(target) || [];
    getIgnoredFilesList();
    white(`Total images in remote folder: ${files.length - 1}`);

    files = files.filter(f => !local.includes(f.basename)).slice(1);
    // Ignore file if it's already in the target. Ignore 1st element — it's a folder

    if (ignoreDeleted) {
        files = files.filter(f => !ignoredFiles.includes(f.basename));
        // Ignore file that was manually deleted from the folder
    }

    if (!files.length) {
        return yellow(`Nothing to do. Sleeping for ${timeout} seconds`);
    }

    white(`New images in remote folder ${files.length}. Will copy to ${target}`);

    await files.forEach(file => {
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
                        ignoredFiles.push(file.basename);
                        fs.writeFileSync(target + `/${ignore}`, ignoredFiles.join("\n"));
                    }
                });
            })
            .catch(error => white(error))
    });
    yellow(`All jobs scheduled. Sleeping for ${timeout} seconds`);
}




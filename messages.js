const chalk = require("chalk");
const green = m => console.log(chalk.green(m));
const red = m => console.log(chalk.red(m));
const yellow = m => console.log(chalk.yellow(m));
const white = m => console.log(chalk.white(m));

module.exports = {green, red, white, yellow};
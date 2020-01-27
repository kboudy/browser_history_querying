#!/usr/bin/env node

const chalk = require("chalk"),
  opn = require("opn"),
  fs = require("fs"),
  homedir = require("os").homedir(),
  path = require("path"),
  moment = require("moment");

const allFields = ["#", "visit_time", "title", "url"];
const argOptions = {
  fields: {
    alias: "f",
    type: "string",
    description: `Comma-delimited field names (${allFields.join(",")})`
  },
  query: {
    alias: "q",
    type: "string",
    description: "find urls & titles containing this"
  },
  url: {
    alias: "u",
    type: "string",
    description: "find urls containing this"
  },
  title: {
    alias: "t",
    type: "string",
    description: "find title containing this"
  },
  launch: {
    alias: "l",
    default: "1",
    type: "string",
    description:
      "launch first url (or #'d, if you supply it) in default browser"
  },
  sort: {
    alias: "s",
    type: "boolean",
    description: "sort by visit_time"
  },
  sort_descending: {
    alias: "S",
    type: "boolean",
    description: "sort by visit_time, descending"
  }
};

const formatAndLocalizeDate = st_dt => {
  var microseconds = parseInt(st_dt, 10);
  var millis = microseconds / 1000;
  var past = new Date(1601, 0, 1).getTime();
  var offset = moment().utcOffset();
  return moment(past + millis + offset * 60000).format("YYYY-MM-DD HH:mm:ss");
};

const writeCompletionFile = () => {
  const fp = path.join(homedir, ".config/zsh/completions/_bhq");
  if (!fs.existsSync(path.dirname(fp))) {
    mkdirp.sync(path.dirname(fp));
  }
  if (!fs.existsSync(fp)) {
    let completionFile = `#compdef bhq\n\n_arguments`;

    for (const o in argOptions) {
      const item = argOptions[o];
      completionFile =
        completionFile +
        ` '-${item.alias}[${item.description.replace(
          "'",
          "''"
        )}]' '--${o}[${item.description.replace("'", "''")}]'`;
    }
    fs.writeFileSync(fp, completionFile);
  }
};

const highlightMatches = (text, isUrlField) => {
  let matchString = isUrlField ? argv.url : argv.title;
  if (!matchString && argv.query) {
    matchString = argv.query;
  }
  if (!matchString) {
    return text;
  }
  const matchIndex = text.toLowerCase().indexOf(matchString.toLowerCase());
  if (matchString < 0) {
    return text;
  }
  let highlighted = text.slice(0, matchIndex);
  highlighted += chalk.bgYellowBright.black(
    text.slice(matchIndex, matchIndex + matchString.length)
  );
  highlighted += text.slice(matchIndex + matchString.length);
  return highlighted;
};

const { argv } = require("yargs")
  .alias("help", "h")
  .version(false)
  .options(argOptions);
const launchSwitchExists =
  process.argv.filter(a => a === "-l" || a === "-launch").length > 0;
const launch = argv.launch && launchSwitchExists;

const historyTempPath = `/tmp/bhq_history`;
fs.copyFileSync(
  path.join(homedir, ".config/BraveSoftware/Brave-Browser/Default/History"),
  historyTempPath
);
const sqlite3 = require("sqlite3").verbose();

const runQuery = () => {
  let db = new sqlite3.Database(historyTempPath, err => {
    if (err) {
      return console.error(err.message);
    }
  });

  db.serialize(() => {
    let whereClause = "where 1=1";
    let orderClause = "order by visit_time";
    if (argv.sort_descending) {
      orderClause = "order by visit_time desc";
    }
    let rowNumber = 1;
    if (argv.title) {
      whereClause += ` and title like '%${argv.title}%'`;
    }
    if (argv.url) {
      whereClause += ` and urls.url like '%${argv.url}%'`;
    }
    if (argv.query) {
      whereClause += ` and (urls.url like '%${argv.query}%' or title like '%${argv.query}%')`;
    }
    const selectedFields = argv.fields ? argv.fields.split(",") : allFields;
    db.each(
      `select urls.url, title, visit_time from visits join urls on visits.url = urls.id ${whereClause} ${orderClause}`,
      (err, row) => {
        let fieldString = "";
        for (const f of selectedFields) {
          if (allFields.includes(f)) {
            switch (f) {
              case "#":
                fieldString += chalk.cyan(`${rowNumber}`);
                break;
              case "url":
                fieldString += chalk.blue(`${highlightMatches(row.url, true)}`);
                break;
              case "visit_time":
                fieldString += chalk.magenta(
                  `${formatAndLocalizeDate(row.visit_time)}`
                );
                break;
              case "title":
                fieldString += chalk.white(
                  `${highlightMatches(row.title, false)}`
                );
                break;
            }
            if (selectedFields.indexOf(f) < selectedFields.length - 1) {
              fieldString += chalk.gray(",");
            }
          }
        }
        if (!launch) {
          console.log(fieldString);
        } else {
          if (parseInt(argv.launch) === rowNumber) {
            opn(row.url);
          }
        }
        rowNumber++;
      }
    );
  });

  db.close(err => {
    if (err) {
      return console.error(err.message);
    }
    fs.unlinkSync(historyTempPath);
  });
};

const debugging =
  typeof v8debug === "object" ||
  /--debug|--inspect/.test(process.execArgv.join(" "));
if (debugging) {
  runQuery();
}
writeCompletionFile();
module.exports = () => {
  runQuery();
};

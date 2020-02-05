#!/usr/bin/env node

const chalk = require("chalk"),
  opn = require("opn"),
  fs = require("fs"),
  homedir = require("os").homedir(),
  mkdirp = require("mkdirp"),
  path = require("path"),
  sqliteAsync = require("sqlite-async"),
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
  minDate: {
    alias: "d",
    type: "string",
    description: "minimum date"
  },
  maxDate: {
    alias: "D",
    type: "string",
    description: "maximum date"
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

const formatAndLocalizeDate = n => {
  return moment(new Date(parseInt(n) / 1000 - 1.16444736e13)).format(
    "YYYY-MM-DD HH:mm:ss"
  );
};

const dateToUnix = d => {
  return (moment(d).unix() * 1000 + 1.16444736e13) * 1000;
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

const mergedDbPath = path.join(
  homedir,
  "Dropbox/app_config/browser_history_querying/mergedHistory"
);

const merge = async () => {
  const historyTempPath = `/tmp/bhq_history`;
  fs.copyFileSync(
    path.join(homedir, ".config/BraveSoftware/Brave-Browser/Default/History"),
    historyTempPath
  );

  if (!fs.existsSync(path.dirname(mergedDbPath))) {
    mkdirp.sync(path.dirname(mergedDbPath));
  }
  if (!fs.existsSync(mergedDbPath)) {
    const mdb = await sqliteAsync.open(mergedDbPath);
    await mdb.run(
      "CREATE TABLE visits (id PRIMARY KEY, url INTEGER, visit_time INTEGER)"
    );
    await mdb.run("CREATE TABLE urls (id PRIMARY KEY, title TEXT, url TEXT)");
    await mdb.close();
  }
  const db = await sqliteAsync.open(historyTempPath);
  await db.run(`ATTACH '${mergedDbPath}'as merged;`);
  const visitCountBefore = (
    await db.get("SELECT COUNT(*) AS cnt FROM merged.visits")
  ).cnt;
  await db.run(
    `INSERT INTO merged.visits select id, url, visit_time from visits WHERE id NOT IN (SELECT id FROM merged.visits)`
  );
  await db.run(
    `INSERT INTO merged.urls select id, title, url from urls WHERE id NOT IN (SELECT id FROM merged.urls)`
  );

  const visitCountAfter = (
    await db.get("SELECT COUNT(*) AS cnt FROM merged.visits")
  ).cnt;
  await db.close();
};

const runQuery = async () => {
  const db = await sqliteAsync.open(mergedDbPath);

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
  if (argv.minDate) {
    whereClause += ` and visit_time >= ${dateToUnix(argv.minDate)}`;
  }
  if (argv.maxDate) {
    whereClause += ` and visit_time <= ${dateToUnix(argv.maxDate)}`;
  }
  const selectedFields = argv.fields ? argv.fields.split(",") : allFields;
  await db.each(
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

  await db.close();
};

const debugging =
  typeof v8debug === "object" ||
  /--debug|--inspect/.test(process.execArgv.join(" "));
if (debugging) {
  (async () => {
    await merge();
    await runQuery();
  })();
}
writeCompletionFile();
module.exports = () => {
  (async () => {
    await merge();
    await runQuery();
  })();
};

#!/usr/bin/env node

const chalk = require("chalk"),
  opn = require("opn"),
  fs = require("fs"),
  homedir = require("os").homedir(),
  path = require("path"),
  moment = require("moment");

const argOptions = {
  fields: {
    alias: "f",
    type: "string",
    description: "Comma-delimited field names (#,visit_time,url,title)"
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

const { argv } = require("yargs")
  .alias("help", "h")
  .version(false)
  .options(argOptions);

const historyTempPath = `/tmp/bhq_history`;
fs.copyFileSync(
  path.join(homedir, ".config/BraveSoftware/Brave-Browser/Default/History"),
  historyTempPath
);
const sqlite3 = require("sqlite3").verbose();
let db = new sqlite3.Database(historyTempPath, err => {
  if (err) {
    return console.error(err.message);
  }
});

db.serialize(() => {
  let whereClause = " where 1=1";
  if (argv.title) {
    whereClause += ` and title like '%${argv.title}%'`;
  }
  if (argv.url) {
    whereClause += ` and urls.url like '%${argv.url}%'`;
  }
  db.each(
    `select urls.url, title, visit_time from visits join urls on visits.url = urls.id ${whereClause}`,
    (err, row) => {
      if (err) {
        console.error(err.message);
      }
      console.log(`${row.url}, ${row.title}, ${row.visit_time}`);
    }
  );
});

db.close(err => {
  if (err) {
    return console.error(err.message);
  }
  fs.unlinkSync(historyTempPath);
});

// const { argv } = require("yargs")
//   .alias("help", "h")
//   .version(false)
//   .options(argOptions);

// const launchSwitchExists =
//   process.argv.filter(a => a === "-l" || a === "-launch").length > 0;
// const launch = argv.launch && launchSwitchExists;

// const deleteBookmarks = (bookmarkJson, flattened, urlsToDelete) => {
//   const stripped = stripBookmarks(bookmarkJson);
//   const survivors = flattened.filter(f => !urlsToDelete.includes(f.url));
//   stripped.roots.bookmark_bar.children = survivors;
//   fs.writeFileSync(config.bookmarkPath, JSON.stringify(stripped));
//   console.log(chalk.white(`Deleted ${urlsToDelete.length} bookmarks:`));
//   console.log(chalk.red(urlsToDelete.join("\n")));
// };

// const queryBookmarks = () => {
//   const bookmarkJson = JSON.parse(fs.readFileSync(config.bookmarkPath));
//   const flattened = gatherAllBookmarks(bookmarkJson);

//   const availableFields = ["#", "date_added", "name", "url"];
//   const outputFields = [];
//   for (const f of (argv.fields || availableFields.join(","))
//     .split(",")
//     .map(f => f.trim().toLowerCase())) {
//     if (availableFields.includes(f)) {
//       outputFields.push(f);
//     }
//   }

//   let sorted = flattened;
//   if (argv.sort_descending) {
//     sorted = flattened.sort((a, b) => b.date_added - a.date_added);
//   } else if (argv.sort) {
//     sorted = flattened.sort((a, b) => a.date_added - b.date_added);
//   }
//   const matches = [];
//   let resultNumber = 0;
//   for (const b of sorted) {
//     let nameMatch;
//     let urlMatch;
//     if (argv.query) {
//       const regEx = new RegExp(argv.query, "i");
//       nameMatch = b.name.match(regEx);
//       urlMatch = b.url.match(regEx);
//       if (!nameMatch && !urlMatch) {
//         continue;
//       }
//     }
//     resultNumber++;

//     let outString = "";
//     let isFirst = true;
//     const chalkColors = [chalk.blue, chalk.white, chalk.magenta, chalk.cyan];
//     for (const f of outputFields) {
//       let renderedField = b[f];
//       if (f === "#") {
//         renderedField = `${resultNumber}`;
//       } else if (f === "date_added") {
//         renderedField = formatAndLocalizeDate(b[f]);
//       } else if (f === "url" && urlMatch) {
//         const beforeMatch = b[f].slice(0, urlMatch.index);
//         const match = urlMatch[0];
//         const afterMatch = b[f].slice(urlMatch.index + match.length);
//         renderedField =
//           chalk.white(beforeMatch) +
//           chalk.black.bgYellowBright(match) +
//           chalk.white(afterMatch);
//       } else if (f === "name" && nameMatch) {
//         const beforeMatch = b[f].slice(0, nameMatch.index);
//         const match = nameMatch[0];
//         const afterMatch = b[f].slice(nameMatch.index + match.length);
//         renderedField =
//           chalk.white(beforeMatch) +
//           chalk.black.bgYellowBright(match) +
//           chalk.white(afterMatch);
//       }
//       if (!isFirst) {
//         outString = outString + chalk.gray(config.delimiter);
//       }
//       isFirst = false;
//       const currentChalkColor = chalkColors.pop();
//       chalkColors.unshift(currentChalkColor); // keep colors rotating if need me
//       outString = outString + `"${currentChalkColor(renderedField)}"`;
//     }
//     matches.push(b);
//     if (!launch) {
//       console.log(chalk.white(outString));
//     }
//   }
//   if (argv.delete) {
//     // because a yargs default (of "1") is supplied for the launch arg, it always says the switch is present
//     // there must be a yargs way to check if it actually was typed, but for now, I'm manually checking
//     const deleteSwitchExists =
//       process.argv.filter(a => a === "-d" || a === "-delete").length > 0;
//     if (deleteSwitchExists) {
//       let urlsToDelete = matches.map(m => m.url);
//       if (argv.delete !== "*") {
//         const lineNumbersToDelete = argv.delete
//           .split(",")
//           .map(n => parseInt(n));
//         const newUrls = [];
//         for (const l of lineNumbersToDelete) {
//           newUrls.push(urlsToDelete[l - 1]);
//         }
//         urlsToDelete = newUrls;
//       }
//       deleteBookmarks(bookmarkJson, flattened, urlsToDelete);
//     }
//   } else {
//     if (!launch) {
//       console.log(chalk.green(`${matches.length} bookmarks`));
//     }
//   }
//   if (launch) {
//     // because a yargs default (of "1") is supplied for the launch arg, it always says the switch is present
//     // there must be a yargs way to check if it actually was typed, but for now, I'm manually checking
//     if (matches.length === 0) {
//       console.log(chalk.red("There were no matches to launch"));
//     } else {
//       const launchIndex = parseInt(argv.launch) - 1;
//       if (isNaN(launchIndex)) {
//         console.log(
//           chalk.red(`"${argv.launch}": launch # should be an integer`)
//         );
//       } else if (launchIndex < 0 || launchIndex >= matches.length) {
//         console.log(chalk.red(`${argv.launch}: No such result # to launch`));
//       } else {
//         opn(matches[launchIndex].url);
//       }
//     }
//   }
// };

// const debugging =
//   typeof v8debug === "object" ||
//   /--debug|--inspect/.test(process.execArgv.join(" "));
// if (debugging) {
//   queryBookmarks();
// }
// writeCompletionFile();
// module.exports = () => {
//   queryBookmarks();
// };

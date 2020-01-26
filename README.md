# browser-history-querying

- query brave/chrome history from command line

* installation _(from this directory, after cloning repo)_:
  - `npm i -g .`

## examples:

```sh
# get help
bhq --help

# list all browser history
bhq

# filter history whose urls or titles have "foo" in them
bhq -q "foo"

# filter history whose titles have "foo" in them
bhq -t "foo"

# filter history whose urls have "foo" in them
bhq -u "foo"

# sort results by visit, ascending
bhq -s
# descending
bhq -S

# return only the "url" and "visit_time" fields (of #,visit_time,title,url)
bhq -f url,visit_time

# launch url in default browser
#    note: if your query returned multiple results, the most recently added will be used
bhq -l
```

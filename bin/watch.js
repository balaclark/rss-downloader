#!/usr/bin/env node

'use strict'

let fs = require('fs')
let path = require('path')
let url = require('url')
let http = require('http')
let async = require('async')
let program = require('commander')
let RssWatcher = require('rss-watcher')
let version = require('../package.json').version

program
  .version(version)
  .option('-u --feed-url <url>', 'RSS Feed Url', '')
  .option('-d --directory <path>', 'Download Directory.')
  .parse(process.argv)

// TODO refactor feed watching / downloading into tested libs

// TODO config refresh rate
let feed = new RssWatcher(program.feedUrl)

feed.on('new article', (err, article) => {
  if (err) throw err
  downloadEnclosures(article, err => {
    if (err) throw err
  })
})

feed.run((err, articles) => {
  if (err) throw err
  async.eachSeries(articles, downloadEnclosures, err => {
    if (err) throw err
  })
})

function downloadEnclosures (article, cb) {
  let enclosures = article.enclosures
  if (!enclosures.length) return
  async.eachSeries(enclosures, (enclosure, next) => {
    // TODO cache download name on success, skip those going forward
    // 1 download per second to respect remote servers
    download(enclosure.url, program.directory, () => setTimeout(next, 1000))
  }, cb)
}

// TODO support non-torrent downloads
function download (fileUrl, dest, cb) {
  let filepath = path.join(dest, path.basename(url.parse(fileUrl).pathname))
  let file = fs.createWriteStream(filepath, { defaultEncoding: 'bencode' })

  http.get(fileUrl, res => {
    console.log('%s %d %s', filepath, res.statusCode, res.headers['content-type'])
    if (res.statusCode !== 200) return fs.unlink(filepath, cb)
    if (res.headers['content-type'] !== 'application/x-bittorrent') return cb()
    res.pipe(file)
    file.on('finish', () => file.close(cb))
  }).on('error', err => {
    fs.unlink(filepath, () => cb(err))
  })
}

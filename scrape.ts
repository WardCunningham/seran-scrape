// denowiki meta-site federation web scraper
// usage: sh seran-wiki.sh --allow-disclosure ../seran-scrape/scrape.ts

import { delay } from "std/util/async.ts";
import { ProcessStep } from "./step.ts";
import { exists } from "std/fs/mod.ts"
import * as wiki from "seran/wiki.ts"

export let plugins = [ "/client/process-step.mjs" ]
export let metaPages = {};

export async function init(opts) { wiki.pages(`

Welcome Visitors

  Welcome to this [[DenoWiki]] Federated Wiki site.
  From this page you can find who we are and what we do.
  New sites provide this information and then claim the site as their own.
  You will need your own site to participate.

  Pages about us.

  [[Ward Cunningham]]

  Pages where we do and share.

  [[Federation Scraper]]


Federation Scraper

  Here we supervise the ongoing scrape of the wiki federation.
  We invision this as cooperating loops where sitemap fetches lead
  to page fetches and these lead to more sitemap fetches.

  See [[Stepping the Async Scrape]]

  While developing this technology we focus first on a nested loop.
  We have several versions of this where we explore different instrumentation strategies.

  [[Mock Computation]]

  [[Start or Stop the Scrape]]

Mock Computation

  Here we start, stop and step a triple nested loop that counts iterations
  until five of each, for 5 * 5 * 5 total iterations have completed.

  process-step:
    text: "Simple Nested Loop",
    href: "/simple"

Start or Stop the Scrape

  An inital scrape can take the better part of a day.
  Press 'start' to begin.
  Shift-'start' to do one site or slug at a time.

  We fetch sitemaps for one site and then discover more.

  process-step:
    text: "Process Next Site",
    href: "/nextsite"

  We fetch page json to index and inspect for more sites.

  process-step:
    text: "Process Next Page",
    href: "/nextslug"

  See [[Queue Stats]], [[Failed Sites]]
`
)}


// S I M P L E   M O C K   C O M P U T A T I O N

let c0 = 1, c1 = 1, c2 = 1;
let l0 = 5, l1 = 5, l2 = 5;

function counters (where) {
  return `${where} at ${c0} ${c1} ${c2}`
}

let simple = new ProcessStep('simple', false, run1).control(metaPages)

async function run1() {
  for (c0 = 1; c0 < l0; c0++) {
    await simple.step(counters('outer'))
    await delay(100);
    for (c1 = 1; c1 < l1; c1++) {
      await simple.step(counters('middle'))
      await delay(100);
      for (c2 = 1; c2 < l2; c2++) {
        await simple.step(counters('inner'))
        await delay(100);
      }
    }
  }
}


// S C R A P E

type site = string;
type slug = string;
type todo = { site: site; slug?: slug; date?: number };

// https://github.com/WardCunningham/Smallest-Federated-Wiki/commit/40f056ae
const birth = Date.parse('Jun 25, 2011, 3:34 PM PDT')

let siteq: todo[] = [];
let slugq: todo[] = [];

let doing: site[] = [];
let done: site[] = [];
let fail: site[] = []

let skip = 0

const more = () => (siteq.length + slugq.length + doing.length) > 0

let nextsite = new ProcessStep('nextsite', false, siteloop).control(metaPages)
let nextslug = new ProcessStep('nextslug', false, slugloop).control(metaPages)

if (!await exists('data')) Deno.mkdir('data')

async function preload(root:site) {
  done = []
  fail = []
  skip = 0

  let files = await Deno.readdir('data')
  if (files.length > 0) {
    scrape(files.map(i=>i.name))
  } else {
    scrape([root])
  }
}

async function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}


// E A C H   S I T E

function scrape(sites: site[]) {
  for (let maybe of sites) {
    if (!doing.includes(maybe) && !done.includes(maybe)) {
      siteq.push({ site: maybe });
    }
  }
}

async function siteloop() {
  let count = 0
  await preload('sites.asia.wiki.org')
  while (more()) {
    if (siteq.length) {
      let job = siteq.shift();
      doing.push(job.site)
      await nextsite.step(`#${count++} ${job.site}`)
      await dosite(job.site);
    }
    await sleep(500)
  }
}

async function dosite(site: site) {
  let url = `http://${site}/system/sitemap.json`;
  let dir = `data/${site}`
  try {
    let sitemap = await fetch(url).then(res => res.json());
    if (sitemap.length == 0) throw "empty sitemap";
    if (!(await exists(dir))) {
      await Deno.mkdir(dir); // new site
    }
    for (let info of sitemap) {
      await update(info.slug, info.date||birth);
    }
  } catch (e) {
    fail.push(site)
    console.log("site trouble", site, e);
  }
  done.push(site);
  doing.splice(doing.indexOf(site), 1);

  async function update(slug: slug, date) {
    let file = `${dir}/${slug}.json`
    let doit = false

    if (!(await exists(file))) {
      doit = true
    } else {
      let stat = await Deno.stat(file);
      let epoch = Math.floor(date/1000)
      if (epoch > stat.modified) {
        doit = true
      }
    } 
    if (doit) {
      slugq.push({ site, slug, date })
      await sleep(500)
    }
     else {
      skip++
    }

  }
}

// E A C H   S L U G

async function slugloop() {
  let count = 0
  while (more()) {
    if (slugq.length) {
      let job = slugq.shift();
      await nextslug.step(`#${count++} ${job.slug}`)
      await doslug(job.site, job.slug, job.date);
    }
    await sleep(500)
  }
}

async function doslug(site: site, slug: slug, date: number) {
  let url = `http://${site}/${slug}.json`;
  try {
    let page = await fetch(url).then(res => res.json());
    let sites: site[] = [];
    for (let item of page.story || []) {
      if (item.site && !sites.includes(item.site)) {
        sites.push(item.site);
      }
    }
    for (let action of page.journal || []) {
      if (action.site && !sites.includes(action.site)) {
        sites.push(action.site);
      }
    }
    await save(sites);
    scrape(sites);
  } catch (e) {
    console.log("slug trouble", site, slug, e);
  }

  async function save(sites: site[]) {
    const epoch = (number) => Math.floor(number/1000)
    let path = `data/${site}/${slug}.json`
    let json = JSON.stringify(sites, null, 2);
    let text = new TextEncoder().encode(json);
    await Deno.writeFile(path, text);
    await Deno.utime(path, epoch(Date.now()), epoch(date))
  }
}


// L I V E   R E P O R T S

function page (title, story) {
  const route = (url, fn) => {metaPages[url] = fn}
  const asSlug = title => title.replace(/\s/g, "-").replace(/[^A-Za-z0-9-]/g, "").toLowerCase()
  const asItems = metatext => metatext.split(/\n+/).map((text) => wiki.paragraph(text))
  route(`/${asSlug(title)}.json`, async (req, _system) => {
    wiki.serveJson(req, wiki.page(title, asItems(story())))
  })
}

page('Queue Stats', () =>
`This is work yet to be done.

${siteq.length} sites queued
${doing.length} sites in flight
${slugq.length} pages queued

This work has been completed.

${done.length} sites done
${fail.length} sites failed
${skip} pages skipped
`)

page('Failed Sites', () =>
`Sites that fail to return a valid sitemap.json

${fail.join(", ")}
`)

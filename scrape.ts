// denowiki meta-site federation web scraper
// usage: sh seran-wiki.sh --allow-disclosure ../seran-scrape/scrape.ts

import { delay } from "std/async/delay.ts";
import { ProcessStep } from "./step.ts";
import { exists } from "std/fs/mod.ts"
import * as wiki from "seran/wiki.ts"
import * as region from "./region.ts"

export let plugins = [ "/client/process-step.mjs" ]
export let handler = region.handler

handler.items("Welcome Visitors", [
  "Welcome to this [[Seran Wiki]] Federation outpost.\
  From this page you can find who we are and what we do.",

  "Pages about us.",
  "[[Ward Cunningham]]",

  "Pages where we do and share.",
  "[[Federation Scraper]]",
  "[[Region Rosters]]"
])

handler.items("Federation Scraper", [

  "Here we supervise the ongoing scrape of the wiki federation.\
  We implement this as cooperating loops where sitemap fetches lead\
  to page fetches and these lead to more sitemap fetches.",
  "See [[Stepping the Async Scrape]]",

  "While developing this technology we focus first on a nested loop.\
  We have several versions of this where we explore different instrumentation strategies.",
  "[[Mock Computation]]",
  "[[Start or Stop the Scrape]]"
])

handler.items("Mock Computation", [
  "Here we start, stop and step a triple nested loop that counts iterations\
  until five of each, for 5 * 5 * 5 total iterations have completed.",
  wiki.item("process-step", { text: "Simple Nested Loop.", href: "/simple" })
])

handler.items("Start or Stop the Scrape", [
  "An inital scrape can take the better part of a day.\
  Press 'start' to begin.\
  Shift-'start' to do one cycle at a time.",

  "We start scrapes hourly skipping hours if they run long.",
  wiki.item("process-step", { text: "Run More Scrapes", href: "/nexttime" }),

  "We fetch sitemaps for one site and then discover more.",
  wiki.item("process-step", { text: "Process Next Site.", href: "/nextsite" }),

  "We fetch page json to index and inspect for more sites.",
  wiki.item("process-step", { text: "Process Next Page.", href: "/nextslug" }),

  "See [[Queue Stats]] while running.",
  "See also [[Active Sites]], [[Failed Sites]], [[Crazy Business]]"
])



// S I M P L E   M O C K   C O M P U T A T I O N

let c0 = 1, c1 = 1, c2 = 1;
let l0 = 5, l1 = 5, l2 = 5;

function counters (where) {
  return `${where} at ${c0} ${c1} ${c2}`
}

let simple = new ProcessStep('simple', false, run1).register(handler)

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
let active: site[] = []
let first: site[] = []
let crazy: any[] = []

let visit = 0
let skip = 0

const more = () => (siteq.length + slugq.length + doing.length) > 0

let nextsite = new ProcessStep('nextsite', false, siteloop).register(handler)
let nextslug = new ProcessStep('nextslug', false, slugloop).register(handler)
let nexttime = new ProcessStep('nexttime', false, timeloop).register(handler)

if (!await exists('data')) Deno.mkdir('data')

async function preload(root:site) {
  done = []
  fail = []
  active = []
  first = []
  crazy = []
  visit = 0
  skip = 0

  let files = Deno.readDir('data')
  let some = false
  for await (let each of files) {
    some = true
    scrape([each.name])
  }
  if (!some) {
    scrape([root])
  }
  crazy.push(`Preloading ${siteq.length} sites.`)
}

async function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}


// E A C H   T I M E

async function timeloop() {
  const hour = (epoch) => (epoch-(epoch%3600000))+3600000
  let when = hour(Date.now())
  while(true) {
    await sleep(60000)
    if(more()) {
      when = hour(Date.now())
    }
    if (Date.now() < when) {
      await nexttime.step(`ready to run at ${(new Date(when)).toLocaleTimeString()}`)
    } else {
      await nexttime.step(`ready to run now`)
      nextsite.button('start')
      await sleep(5000)
      nextslug.button('start')
    }
  }
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
      first.push(site)
    }
    for (let info of sitemap) {
      await update(info.slug, info.date||birth);
    }
  } catch (e) {
    if (!fail.includes(site)) { // shouldn't happen, but does
      fail.push(site)
      crazy.push(`Site trouble, ${e.message}. [http://${site} site]`)
      console.log("site trouble", site, e)
    }
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
      if (epoch > stat.mtime.getTime()) {
        doit = true
      }
    } 
    if (doit) {
      if (!active.includes(site) && !first.includes(site)) active.push(site)
      slugq.push({ site, slug, date })
      visit++
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
    crazy.push(`Slug trouble, ${e.message}. [http://${site}/${slug}.html page]`)
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

handler.items("Queue Stats", () => [
  "Live counts updated continuously while scrapping.",

  "This is work yet to be done.",
  `${siteq.length} sites queued`,
  `${doing.length} sites in flight`,
  `${slugq.length} pages queued`,

  "This work has been completed.",
  `${done.length} sites done`,
  `${fail.length} sites failed`,
  `${visit} pages visited`,
  `${skip} pages skipped`
])

handler.items("Failed Sites", () => [
  "Sites that have failed to return a valid sitemap.json.",
  ...fail
])

handler.items("Active Sites", () => [
  "Sites active since last scrape.",
  wiki.item("roster", {text: active.join("\n")}),
  ...active,
  "Sites that are new to this scraper.",
  wiki.item("roster", {text: first.join("\n")}),
  ...first
])

handler.items("Crazy Business", () => crazy)


// R E G I O N.   R O S T E R S

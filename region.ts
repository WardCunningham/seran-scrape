import { readFileStr, exists } from "std/fs/mod.ts";
import * as wiki from "seran/wiki.ts";

export let handler = new wiki.Handler()

let rootSite = "fed.wiki.org";

handler.items("Welcome Visitors", [
  "Welcome to this [[Seran Wiki]] Federation outpost.\
  From this page you can find who we are and what we do.",
  "Pages about us.",
  "[[Joshua Benuck]]",
  "[[Ward Cunningham]]",
  "Pages where we do and share.",
  "[[Region Rosters]]"
])

handler.items("Region Rosters", [
  "Region crawling [[Configuration]]",
  "[[One Degree]]",
  "[[Two Degrees]]",
  "[[Three Degrees]]"
])

handler.items("One Degree", async () => [
  "Generated roster.",
  wiki.item("roster", {text: [...(await oneDegreeAway(rootSite)).values()].join("\n")})
])

handler.items("Two Degrees", async () => [
  "Generated roster.",
  wiki.item("roster", {text: [...(await twoDegreesAway(rootSite)).values()].join("\n")})
])

handler.items("Three Degrees", async () => [
  "Generated roster.",
  wiki.item("roster", {text: [...(await threeDegreesAway(rootSite)).values()].join("\n")})
])

handler.items("Configuration", async (req,sys) => [
  "We currently only support a fixed configuration compiled into the server.",
  `Root site for rosters: ${rootSite}`,
  `Number of scraped sites: ${(await readDir('data')).length}`,
   "See [[Sites]] for the full list."
])

handler.items("Sites", async () => [
  "This is the full list of sites for which we have references recorded.\
  See [[Federation Scraper]] to enlarge this list.",
  ...(await readDir('data')).map(i=>i.name)
 ])

async function readDir(path) {
  let fileInfo = await Deno.stat(path);
  if (!fileInfo.isDirectory()) {
    console.log(`path ${path} is not a directory.`);
    return [];
  }
  return Deno.readdir(path);
}

async function referencedSites(siteName) {
  let sites = new Set();
  let siteDir = `data/${siteName}`;
  if (!await exists(siteDir)) {
    console.log(`WARN: Site ${siteDir} doesn't exist`);
    return sites;
  }
  let files = await readDir(siteDir);
  for (let file of files) {
    let filename = `${siteDir}/${file.name}`;
    if (!await exists(filename)) {
      console.log(`WARN: ${filename} doesn't exist`);
      continue;
    }
    let contents = await readFileStr(filename);
    let localSites = JSON.parse(contents);
    localSites.forEach((s) => sites.add(s));
  }
  return sites;
}

async function oneDegreeAway(siteName) {
  let sites = new Set();
  (await referencedSites(siteName)).forEach((s) => sites.add(s));
  return sites;
}

async function anotherDegreeAway(someDegree) {
  let anotherDegree = new Set();
  for (let site of someDegree) {
    anotherDegree.add(site);
    (await oneDegreeAway(site)).forEach((s) => anotherDegree.add(s));
  }
  return anotherDegree;
}

async function twoDegreesAway(siteName) {
  let oneDegree = await oneDegreeAway(siteName);
  return anotherDegreeAway(oneDegree);
}

async function threeDegreesAway(siteName) {
  let twoDegrees = await twoDegreesAway(siteName);
  return anotherDegreeAway(twoDegrees);
}


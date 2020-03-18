# denowiki-scrape
Federation scraper coded as a denowiki meta-site with wiki plugin start/stop/step controls

![Scraper Lineup](https://user-images.githubusercontent.com/12127/77013634-aa4f7400-692d-11ea-90db-b384b1ab9ed7.png)

Let's explain that description word for word from left to right:
- The federation consists of wiki sites that have pages with some history on other sites.
- We read wiki sitemaps to discover new pages and then read them to discover new sites.
- We've coded the federation traversal algorithm in TypeScript using site and page loops separated by queues.
- We run our code in the deno runtime where we have new implementations of wiki client and server.
- Denowiki can load modules (meta-sites) that serve any number of wiki pages, often algorithmetically produced.
- This meta-site runs a scraper and offers pages for starting or stopping the site and page loops.
- The start/stop/step controls are provided by a plugin with configurable client and server parts.

FROM seran-wiki

ADD . /seran-scrape
CMD ["--meta-site=../seran-scrape/scrape.localhost.ts@scrape.localtest.me"]
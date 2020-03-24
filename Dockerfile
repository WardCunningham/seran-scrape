FROM docker.pkg.github.com/wardcunningham/seran-wiki/seran-wiki:latest

ADD . /seran-scrape
CMD ["--meta-site=../seran-scrape/scrape.localhost.ts@scrape.seran.c2.com"]
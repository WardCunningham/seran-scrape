FROM docker.pkg.github.com/wardcunningham/seran-wiki/seran-wiki:latest

ADD . /seran-scrape
CMD ["--port=80:8000", "../seran-scrape/scrape.ts"]

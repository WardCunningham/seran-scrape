FROM docker.pkg.github.com/wardcunningham/seran-wiki/seran-wiki:latest

ADD . /seran-scrape
RUN chmod a+w .
CMD ["--meta-site=../seran-scrape/scrape.localhost.ts@scrape.localtest.me"]
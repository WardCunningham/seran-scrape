// Server-side start/stop/step support for process-step plugin

import * as wiki from "seran/wiki.ts"

export class ProcessStep {
  name: string
  status: string
  running: boolean
  waiting: any
  resume: any
  run: any

  constructor(name, running, run) {
    this.name = name
    this.status = 'beginning';
    this.running = running;
    this.waiting = null;
    this.resume = null;
    this.run = run;
  }

  async step(now) {
    this.status = now
    console.log(this.name, now)
    if (!this.running) {
      return this.waiting = new Promise(resolve => {
        this.resume = resolve
      })
    } else {
      return null
    }
  }

  async button(action) {

    async function sleep(ms) {
      return new Promise(resolve => {
        setTimeout(resolve, ms);
      });
    }

    if (action == 'start') {
      console.log('start')
      if (!this.running && !this.waiting) {
        this.running = true
        let t0 = Date.now()
        console.log('run',this.run)
        this.run().then(() => {
          console.log('done',this.run)
          this.running=false;
          this.status=`complete in ${(Date.now()-t0)/1000} seconds`
        });
      } else if (this.waiting) {
        this.waiting = null;
        this.running = true
        console.log('resume',this.run)
        this.resume()
      }
    }

    if (action == 'step') {
      console.log('step',this.run)
      if (this.running) {
        this.running = false;
      } else if (this.waiting) {
        this.waiting = null;
        await sleep(30)
        this.resume()
      }
    }

    if (action == 'stop') {
      console.log('stop',this.run)
      if (this.running) {
        this.running = false;
      }
    }
  }

  register(handler) {

    function route (verb) {
      handler.route(`/${this.name}\\?action=${verb}`, req => {
        this.button(verb)
        wiki.serveJson(req, {
          running: this.running,
          waiting: !!this.waiting,
          status: this.status
        })
        return true
      })
    }

    route.call(this,'start')
    route.call(this,'stop')
    route.call(this,'step')
    route.call(this,'state')

    return this
  }
}


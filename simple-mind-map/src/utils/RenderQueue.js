// 将一次异步节点渲染分成短任务，避免为每个节点创建一个定时器。
class RenderQueue {
  constructor(beforeFlush, onIdle, timeBudget = 8) {
    this.tasks = []
    this.index = 0
    this.timer = null
    this.running = false
    this.cancelled = false
    this.beforeFlush = beforeFlush
    this.onIdle = onIdle
    this.timeBudget = timeBudget
  }

  push(task) {
    if (this.cancelled) return
    this.tasks.push(task)
    if (!this.running && this.timer === null) this.schedule()
  }

  schedule() {
    this.timer = setTimeout(() => this.flush(), 0)
  }

  flush() {
    this.timer = null
    if (this.cancelled) return
    this.running = true
    this.beforeFlush()
    const start = performance.now()
    try {
      do {
        const task = this.tasks[this.index]
        this.tasks[this.index++] = null
        task()
      } while (
        !this.cancelled &&
        this.index < this.tasks.length &&
        performance.now() - start < this.timeBudget
      )
    } finally {
      this.running = false
      if (!this.cancelled && this.index < this.tasks.length) {
        this.schedule()
      } else {
        this.tasks = []
        this.index = 0
        this.onIdle()
      }
    }
  }

  cancel() {
    this.cancelled = true
    clearTimeout(this.timer)
    this.timer = null
    this.tasks = []
    this.index = 0
  }
}

export default RenderQueue

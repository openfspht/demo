const processes = [
    Bun.spawn(["bun", "--watch", "--preload", "./server/instrument.ts", "server/main.ts"], {
        stdio: ["inherit", "inherit", "inherit"],
    }),
    Bun.spawn(["bunx", "vp", "dev"], { stdio: ["inherit", "inherit", "inherit"] }),
]

const stop = () => processes.forEach((child) => child.kill())
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
await Promise.race(processes.map((child) => child.exited))
stop()

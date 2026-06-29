#!/usr/bin/env node
import 'dotenv/config'
import { render } from 'ink'
import App from './app.js'

const { waitUntilExit } = render(<App onExit={() => setTimeout(() => process.exit(0), 50)} />, { exitOnCtrlC: false })

waitUntilExit().then(() => {
  process.exit(0)
})

import { mount } from 'svelte'
import '@fontsource-variable/schibsted-grotesk'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/bricolage-grotesque'
import './styles/global.css'
import App from './App.svelte'

mount(App, { target: document.getElementById('app')! })

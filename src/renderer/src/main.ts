import { mount } from 'svelte'
import '@fontsource-variable/inter'
import '@fontsource-variable/bricolage-grotesque'
import './styles/global.css'
import App from './App.svelte'

mount(App, { target: document.getElementById('app')! })

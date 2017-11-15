import React from 'react'
import ReactDOM from 'react-dom'
import { Provider } from 'react-redux'

import { AswCalcMain } from './ui'
import { register } from './registerServiceWorker'
import { store } from './store'

import './assets/index.css'

ReactDOM.render(
  (
    <div className="root">
      <Provider store={store}>
        <AswCalcMain />
      </Provider>
    </div>
  ),
  document.getElementById('root'))
register()

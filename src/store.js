import { createStore } from 'redux'

const reducer = (state = 'dummy', _action) => state
const store = createStore(reducer)

export { store }

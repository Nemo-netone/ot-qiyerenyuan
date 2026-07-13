import axios from 'axios'
import ElementUI from 'element-ui'
import store from '../store'
import { getApiBaseURL } from './apiBase'

const instance = axios.create({
  baseURL: getApiBaseURL(),
  timeout: 30000
})

instance.interceptors.request.use(config => {
  config.headers['Content-Type'] = 'application/json;charset=utf-8'
  config.headers.token = store.state.token.token
  return config
}, error => {
  return Promise.reject(error)
})

instance.interceptors.response.use(response => {
  const res = response.data

  if (res.code === 800 || res.code === 900 || res.code === 1200 || res.code === 1300 || res.code === 1400) {
    if (res.code !== 1400) {
      ElementUI.Message({
        message: res.message,
        type: 'error',
        duration: 5 * 1000
      })
    }

    return store.dispatch('staff/logout').then(() => Promise.reject(res.message))
  } else {
    return res
  }
}, error => {
  const status = error.response && error.response.status
  const message = (error.response && error.response.data && error.response.data.message) || error.message
  if (status === 401) {
    return store.dispatch('staff/logout').then(() => Promise.reject(error))
  }
  ElementUI.Message({
    message,
    type: 'error',
    duration: 5 * 1000
  })
  return Promise.reject(error)
})

export default instance

import axios from 'axios';

window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

// Allow cookies to be sent to the Laravel API.
window.axios.defaults.withCredentials = true;

// Automatically read the XSRF-TOKEN cookie and attach
// the X-XSRF-TOKEN header to supported Axios requests.
window.axios.defaults.withXSRFToken = true;

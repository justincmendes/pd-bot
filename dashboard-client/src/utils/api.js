import axios from 'axios';

export function getUserDetails() {
    return axios.get( 'http://localhost:3001/api/auth', {
        withCredentials: true
    });
}
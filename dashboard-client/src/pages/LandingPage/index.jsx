import React from 'react';
import {Button} from '@chakra-ui/core';

export function LandingPage(props) {
    const login = () => window.location.href = 'http://localhost:3001/api/auth/discord';
    return (
        <Button
        onClick={login}
        variantColor="blue"
    >Login</Button>
    );
}
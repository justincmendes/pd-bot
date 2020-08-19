import React from 'react';

import { Formik } from 'formik';
import { Input, Button } from '@chakra-ui/core';

export function DashboardMenu({
    history,
    guildID,
    user,
    config,
    updatePrefix
}) {
    return (
        <Formik
            initialValues={{ prefix: config.prefix }}
            onSubmit={({ prefix }) => {
                updatePrefix(prefix);
            }}
        >
            {
                (props) => (
                    <form onSubmit={props.handleSubmit}>
                        <Input type="text" name="prefix" onChange={props.handleChange} defaultValue={config.prefix} />
                        <Button type="submit" variantColor="blue" children="Update Prefix" />
                    </form>
                )
            }
        </Formik>
    );
}
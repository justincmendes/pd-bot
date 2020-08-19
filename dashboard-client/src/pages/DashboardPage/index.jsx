import React from 'react';
import { getUserDetails, getGuildConfig, updateGuildPrefix } from '../../utils/api';
import { DashboardMenu } from '../../components';

export function DashboardPage({
    history,
    match,
}) {
    // Check if user is authenticated, create state variable
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [config, setConfig] = React.useState({});
    React.useEffect(() => {
        getUserDetails()
            .then(({ data }) => {
                console.log(data);
                // Update user state variable
                setUser(data);
                return getGuildConfig(match.params.id);
            }).then(({ data }) => {
                console.log(data);
                setConfig(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                // Bring user back to main route
                history.push('/');
                setLoading(false);
            });
        // Add empty dependency array
    }, []);

    const updateGuildPrefixParent = async (prefix) => {
        try {
            const update = await updateGuildPrefix(match.params.id, prefix);
            console.log(update);
        }
        catch (err) {
            console.error(err);
        }
    }

    return !loading && (
        <div>
            <h1>Dashboard Page</h1>
            <DashboardMenu user={user} config={config} updatePrefix={updateGuildPrefixParent} />
        </div>
    );
}
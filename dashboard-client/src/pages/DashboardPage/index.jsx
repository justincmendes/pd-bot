import React from 'react';
import { getUserDetails } from '../../utils/api';

export function DashboardPage({
    history,
}) {
    // Check if user is authenticated, create state variable
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        getUserDetails()
            .then(({ data }) => {
                console.log(data);
                // Update user state variable
                setUser(data);
                setLoading(false);
            }).catch((err) => {
                console.error(err);
                // Push to main route
                history.push('/');
                setLoading(false);
            });
        // Add empty dependency array
    }, []);

    return !loading && (
        <div>
            <h1>Dashboard Page</h1>
        </div>
    );
}
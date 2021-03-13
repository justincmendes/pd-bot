import React from "react";
import { getUserDetails, getGuilds } from "../../utils/api";
import { MenuComponent } from "../../components";
export function MenuPage({ history }) {
  // Check if user is authenticated, create state variable
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [guilds, setGuilds] = React.useState({});

  React.useEffect(() => {
    getUserDetails()
      .then(({ data }) => {
        console.log(data);
        // Update user state variable
        setUser(data);
        return getGuilds();
      })
      .then(({ data }) => {
        console.log(data);
        setGuilds(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        // Push to main route
        history.push("/");
        setLoading(false);
      });
    // Add empty dependency array
  }, []);

  return (
    !loading && (
      <div>
        <h1>Menu Page</h1>
        <MenuComponent guilds={guilds} />
      </div>
    )
  );
}

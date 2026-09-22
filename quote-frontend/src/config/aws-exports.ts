import { ResourcesConfig } from 'aws-amplify';

const awsConfig: ResourcesConfig = {
    Auth: {
        Cognito: {
            userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
            userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
            loginWith: {
                oauth: {
                    domain: import.meta.env.VITE_COGNITO_DOMAIN,
                    scopes: ['email', 'openid', 'profile', 'aws.cognito.signin.user.admin'],
                    redirectSignIn: [window.location.origin + '/'],
                    redirectSignOut: [window.location.origin + '/logout'],
                    responseType: 'code',
                    providers: [{ custom: 'Google' }],
                },
            },
        },
    },
};

export default awsConfig;
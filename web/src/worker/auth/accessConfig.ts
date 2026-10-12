export interface AccessConfig {
    ACCESS_TEAM_DOMAIN: string;
    ACCESS_AUD: string;
    /** Local development only, set in .dev.vars. Never configure this on the deployed Worker. */
    DEV_OWNER?: string;
    /** Signs the owner cookie that lets share links recognise you outside the Access-protected paths. */
    OWNER_COOKIE_SECRET?: string;
}

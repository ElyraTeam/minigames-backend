export {};

declare global {
  namespace Express {
    interface Request {}
  }

  namespace CookieSessionInterfaces {
    interface CookieSessionObject {
      id?: string;
      /**
       * Is true if the session has been changed during the request.
       */
      isChanged?: boolean | undefined;

      /**
       * Is true if the session is new.
       */
      isNew?: boolean | undefined;

      /**
       * Determine if the session has been populated with data or is empty.
       */
      isPopulated?: boolean | undefined;
    }
  }
}

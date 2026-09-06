# company-hub

A simple internal web app for a small, globally distributed firm to view and maintain information about the companies it works with. Use a straightforward application stack, such as a Bootstrap-based SPA for the frontend and FastAPI with SQLite for the backend.

The app provides a central place to browse companies, view a company profile, add and edit information, and see useful information associated with each company. Start with a small set of realistic companies as seed data.

The application should distinguish between structured company information stored in the relational database and files or generated artifacts associated with those companies. Files and artifacts should be handled through a simple object-storage capability so the application can support documents and generated outputs without treating the files themselves as database content.

As an initial example, the application may generate a simple, clean PDF summary based on information stored for a company and make that document available from the company profile.

The application is intended to serve as a lightweight backbone for other internal workflows rather than as a comprehensive CRM or firm-wide system of record. Automated workflows, such as n8n-based processes, should eventually be able to use Company Hub as a consistent place to retrieve company information and contribute new structured information or company-associated artifacts generated from sources such as Slack messages, uploaded files, financial updates, news, and AI-assisted analysis.

The initial application should remain simple and understandable while being designed in a way that does not unnecessarily prevent additional company-related workflows and capabilities from being added later.

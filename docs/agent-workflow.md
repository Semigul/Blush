# Agentiskt GitHub-flöde

## Första konfigurationen

1. Öppna **Settings → Pages → Build and deployment** och välj **GitHub Actions** som källa.
2. Skapa labels: `idea`, `agent:refine`, `story:ready`, `agent:implement` och `agent:in-review`.
3. Skapa eller öppna ett GitHub Project och lägg till repositoryts issues där.
4. Skydda `main` med en ruleset som kräver pull request och att kontrollen **Kontrollera pull request / validate** lyckas.

Workflowet använder GitHub Models med det automatiska `GITHUB_TOKEN`. Ingen separat OpenAI API-nyckel behövs. GitHubs kostnadsfria Models-kvot är rate-limitad; om kvoten tar slut misslyckas körningen utan att ändra issuen eller skapa en PR. Betald användning aktiveras inte av workflowet.

## Dagligt flöde

1. Skapa ett issue med formuläret **Idé eller story**, eller konvertera ett draft-kort i GitHub Projects till ett issue i detta repository.
2. Lägg till `agent:refine`. Agenten ersätter issue-bodyn med en genomförbar story och lägger till `story:ready`.
3. Granska storyn och redigera den direkt i GitHub. Lägg till `agent:implement` när den är godkänd.
4. Agenten skapar en unik branch, implementerar storyn och öppnar en pull request mot `main`.
5. Granska PR:n och mergea den när kontrollerna är gröna.
6. Merge till `main` startar Pages-workflowet och publicerar webbplatsen automatiskt.

Om en agentkörning misslyckas ligger issuen kvar. Rätta storyn eller konfigurationen, ta bort trigger-labeln och lägg sedan till den igen för ett nytt försök.

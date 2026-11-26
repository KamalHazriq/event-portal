# Photos in SharePoint or OneDrive (guide for the IT team)

Goal: every photo shared at the summit is also saved, at full quality, in a
SharePoint document library owned by the company, so the originals do not take
space in the portal's database. The portal keeps only small copies for the
photo wall.

What the portal needs from IT is **an app identity that may write to one
SharePoint site**, and four values. Nothing else in the company is reachable
with it.

## What to give the developer in the end

| Value                                        | Example                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| Tenant ID                                    | `11111111-2222-3333-4444-555555555555`                                           |
| Client ID (application ID)                   | `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`                                           |
| Client secret (value, not the secret ID)     | shown once when created                                                          |
| SharePoint site and document library address | `https://contoso.sharepoint.com/sites/PowerSummit` and the library name `Photos` |

The client secret goes into the Firebase secret store, never into the code.

## 1. Register the app (Microsoft Entra admin center)

1. Sign in to <https://entra.microsoft.com> as an Application Administrator.
2. Identity, Applications, **App registrations**, **New registration**.
3. Name: `Power Summit Portal photos`. Supported account types: **Accounts in
   this organizational directory only** (single tenant). No redirect address.
4. Register. Copy the **Application (client) ID** and the **Directory
   (tenant) ID** from the Overview page.

## 2. Give it only the permission it needs

Use the narrow permission, `Sites.Selected`, so the app can touch one site and
nothing else:

1. In the app, **API permissions**, **Add a permission**, **Microsoft Graph**,
   **Application permissions**.
2. Add **Sites.Selected**.
3. Press **Grant admin consent for (your organisation)** and confirm. The
   status column must show a green tick.

## 3. Create the secret

1. **Certificates & secrets**, **New client secret**, description
   `portal`, expiry: 6 months (the event is short).
2. Copy the **Value** straight away. It is shown once.

## 4. Make the SharePoint site and library

1. Create a team or communication site, for example `PowerSummit`, owned by
   the event team.
2. In it, use the default **Documents** library, or create a library called
   `Photos`. Create a folder per day if wanted: the portal can do that too.
3. Share nothing publicly. Give the event team read access as needed.

## 5. Let the app write to that one site

`Sites.Selected` does nothing until the site itself says so. Run this once, as
an administrator, with Microsoft Graph Explorer
(<https://developer.microsoft.com/graph/graph-explorer>) or PowerShell:

1. Find the **site ID**: `GET https://graph.microsoft.com/v1.0/sites/contoso.sharepoint.com:/sites/PowerSummit`
   and copy the `id` of the answer.
2. Grant the app write access:

```
POST https://graph.microsoft.com/v1.0/sites/{site-id}/permissions
Content-Type: application/json

{
  "roles": ["write"],
  "grantedToIdentities": [
    { "application": { "id": "<client id>", "displayName": "Power Summit Portal photos" } }
  ]
}
```

(Graph Explorer needs the delegated permission `Sites.FullControl.All` to run
this, consented for the administrator only.)

## 6. Check with one test upload

With the three values, from any terminal (this proves the permissions before
anyone writes code):

```
# 1. a token
curl -s -X POST "https://login.microsoftonline.com/<tenant id>/oauth2/v2.0/token" \
  -d "client_id=<client id>" -d "client_secret=<secret value>" \
  -d "scope=https://graph.microsoft.com/.default" -d "grant_type=client_credentials"

# 2. put a small file in the library (use the access_token from step 1)
curl -s -X PUT \
  "https://graph.microsoft.com/v1.0/sites/<site id>/drive/root:/test.txt:/content" \
  -H "Authorization: Bearer <access token>" -H "Content-Type: text/plain" \
  --data "hello"
```

An answer with `"name": "test.txt"` means it works. Delete the test file.

## 7. What the developer builds once the values arrive

- Each approved photo is copied to the library in the background, full size,
  named by day and time, with the caption in the file name or a metadata
  column.
- The portal keeps a small copy for the wall and the big screen, so those stay
  fast, and the database holds roughly a tenth of what it does now.
- "Download all" for the secretariat links to the SharePoint folder.
- If SharePoint is unreachable, uploads still succeed: the photo is kept in the
  portal and copied across when it comes back.

## Security notes

- The secret is stored in the Firebase secret store, like the PIN, and set to
  expire. Delete the app registration (or the secret) after the event.
- `Sites.Selected` limits the app to the one site. Do not use
  `Files.ReadWrite.All` or `Sites.ReadWrite.All`: they reach the whole tenant.
- Photos can include faces: the library should follow the company's rules for
  event photos, and be removed from the site when no longer needed.

# Store listing drafts (Apple App Store and Google Play)

Plain wording only: no claims of a trained or proprietary model until the gates in
`model/PROPRIETARY_MODEL_PROGRAM.md` are met.

- **App name:** Triangle LLM
- **Subtitle (Apple, 30 chars):** TriangleOS AI chat preview
- **Short description (Google, 80 chars):** Early preview of TriangleOS's own AI chat, using your TriangleOS account.
- **Category:** Productivity
- **Price:** Free. No in-app purchases.
- **Developer / seller:** Finsec Associates Limited, trading as TriangleOS
- **Support URL:** https://llm.triangleos.com
- **Privacy policy URL:** https://llm.triangleos.com/privacy (page to publish before submission)
- **Account deletion URL (Google):** https://llm.triangleos.com/delete-account (page to publish before submission)

## Full description

Triangle LLM is an early research preview of the AI model TriangleOS is building.

- Sign in with your TriangleOS account (Apple or Google).
- See which TriangleOS region your account is assigned to. Your chats are handled only in that region.
- Chat with the current Triangle model.

This is a preview. Answers can be wrong, incomplete or make no sense, so don't rely on them for
medical, legal, financial or safety decisions. You can delete your TriangleOS account from inside the app.

## Data declarations (Apple App Privacy / Google Data safety)

| Data | Collected | Why | Linked to user | Shared |
|---|---|---|---|---|
| Email address | Yes (from sign-in) | Account | Yes | No |
| User ID | Yes | Account, region access | Yes | No |
| Chat messages | Sent to TriangleOS's model service to answer them; not stored by the gateway | App functionality | Yes, while processing | No |
| Location, contacts, photos, device ID, ads ID | No | | | |

- No tracking and no ads (Apple "Data Not Used to Track You").
- Data is encrypted in transit (HTTPS). Users can delete their account in the app.
- Encryption export: the app only uses standard HTTPS, so `usesNonExemptEncryption` is false.

## Age rating

No user-generated content shared with others, no gambling, no mature themes. Because AI replies are unfiltered in a research preview, answer the questionnaire's "unrestricted web access / AI-generated content" questions honestly; expect 12+ (Apple) / Teen (Google).

## App review notes (Apple)

Provide a demo account with `triangle_region_id` set in app_metadata, and say: "Research preview of TriangleOS's AI model. Sign in with the demo account, open chat, send a message. Account deletion: Region screen, Delete my account."

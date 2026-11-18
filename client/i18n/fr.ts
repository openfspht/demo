import type { Messages } from "./en"

export const fr: Messages = {
    shop: "TiMache",
    tagline: "Une sélection de produits du terroir haïtien.",
    demo: "Boutique de démonstration : marchand fictif, aucune commande n'est expédiée.",
    nav: { shop: "Boutique", orders: "Commandes", cart: "Panier" },
    aisles: {
        all: "Tout",
        coffee: "Café",
        cacao: "Cacao",
        fruit: "Fruits",
        spirits: "Rhum",
        pantry: "Épicerie",
    },
    featured: "Sélection de la semaine",
    add: "Ajouter au panier",
    added: "Dans votre panier",
    from: "Origine",
    aisle: "Rayon",
    size: "Format",
    view: (name: string) => `Voir ${name}`,
    back: "Retour à la boutique",
    cart: {
        title: "Votre panier",
        empty: "Votre panier est vide.",
        browse: "Parcourir les produits",
        quantity: "Quantité",
        remove: "Retirer",
        decrease: (name: string) => `Réduire la quantité de ${name}`,
        increase: (name: string) => `Augmenter la quantité de ${name}`,
        total: "Total",
        checkout: "Passer au paiement",
        count: (count: number) => (count === 1 ? "1 article" : `${count} articles`),
    },
    stations: {
        cart: "Panier",
        pay: "Paiement",
        approve: "Approbation",
        done: "Confirmée",
    },
    checkout: {
        title: "Paiement",
        provider: "Payer avec",
        phone: "Numéro de téléphone",
        phoneHint:
            "Facultatif. Saisissez le numéro utilisé pour approuver le paiement si le service le demande. Format accepté : +509 40 00 0000 ou les huit chiffres du numéro national.",
        pay: (total: string) => `Payer ${total}`,
        paying: "Création du paiement",
        secured:
            "Le statut du paiement est confirmé par le serveur de paiement. Le retour vers la boutique ne suffit pas à confirmer le paiement.",
        noProvider: "Aucun service de paiement n'est disponible actuellement.",
        unreachable:
            "Impossible de joindre le serveur de paiement. Vérifiez votre connexion, puis réessayez.",
    },
    order: {
        title: (reference: string) => `Commande ${reference}`,
        status: {
            pending: "En attente de votre paiement",
            succeeded: "Paiement confirmé",
            failed: "Paiement échoué",
            expired: "Délai de paiement expiré",
            canceled: "Paiement annulé",
        } as Record<string, string>,
        hint: {
            pending:
                "Cette page se met à jour automatiquement lorsque le résultat du paiement est disponible.",
            succeeded:
                "Le paiement de démonstration est confirmé. Aucune commande ne sera expédiée.",
            failed: "Vous pouvez réessayer avec un autre service de paiement.",
            expired: "Relancez le paiement depuis votre panier.",
            canceled: "Le paiement a été annulé.",
        } as Record<string, string>,
        continueTo: (provider: string) => `Continuer vers ${provider}`,
        approve: "Approuvez le paiement sur votre téléphone.",
        paidWith: "Payé avec",
        webhooks: "Webhooks vérifiés",
        webhooksHint:
            "La boutique a vérifié la signature de chaque événement webhook accepté pour mettre à jour le statut du paiement.",
        noWebhooks: "Aucun webhook reçu pour l'instant.",
        source: "Statut obtenu auprès du serveur de paiement.",
        notFound:
            "Aucune commande ne correspond à cette référence. Vérifiez la référence utilisée.",
    },
    errors: {
        "invalid-body":
            "La boutique n'a pas pu lire la commande. Rechargez la page, puis réessayez.",
        "invalid-line":
            "Un produit du panier n'est plus proposé ou sa quantité n'est pas comprise entre 1 et 20.",
        "empty-cart": "Votre panier est vide.",
        "unknown-provider": "Ce service de paiement n'est pas disponible. Choisissez-en un autre.",
        "invalid-phone":
            "Saisissez un numéro comme +509 40 00 0000 ou les huit chiffres du numéro national.",
        "rejected-request":
            "La demande de paiement a été refusée. Vérifiez le numéro, puis réessayez.",
        "attempt-conflict": "Votre panier a changé pendant le paiement. Réessayez.",
        "unknown-order":
            "Aucune commande ne correspond à cette référence. Vérifiez la référence utilisée.",
        payment:
            "Le serveur de paiement n'a pas pu créer le paiement. Réessayez : la même commande sera reprise.",
    },
    orders: {
        title: "Vos commandes",
        empty: "Aucune commande pour l'instant.",
        previous: "Précédente",
        next: "Suivante",
        page: (page: number, total: number) => `Page ${page} sur ${total}`,
    },
}

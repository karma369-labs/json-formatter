export interface SamplePayload {
  id: string;
  name: string;
  category: 'API' | 'GeoJSON' | 'E-Commerce' | 'Edge Cases' | 'Config';
  description: string;
  content: string;
}

export const TEST_PAYLOADS: SamplePayload[] = [
  {
    id: 'api-users',
    name: 'REST API Response',
    category: 'API',
    description: 'Paginated user list with nested profiles, roles, and status flags',
    content: JSON.stringify(
      {
        status: "success",
        code: 200,
        page: 1,
        per_page: 2,
        total: 42,
        data: [
          {
            id: "usr_991823",
            name: "Alex Morgan",
            email: "alex.morgan@example.com",
            role: "administrator",
            verified: true,
            avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
            created_at: "2026-01-15T08:30:00Z",
            settings: {
              theme: "dark",
              notifications: { email: true, push: false, sms: true },
              "2fa_enabled": true
            },
            tags: ["admin", "core-team", "beta-tester"]
          },
          {
            id: "usr_991824",
            name: "Sarah Chen",
            email: "sarah.c@example.com",
            role: "developer",
            verified: true,
            avatar_url: null,
            created_at: "2026-02-01T14:22:10Z",
            settings: {
              theme: "system",
              notifications: { email: false, push: true, sms: false },
              "2fa_enabled": false
            },
            tags: ["dev", "frontend"]
          }
        ],
        meta: {
          server_time: "2026-08-05T22:45:00Z",
          response_ms: 18.4,
          rate_limit: { limit: 1000, remaining: 994, reset: 1770248400 }
        }
      },
      null,
      2
    )
  },
  {
    id: 'broken-autofix',
    name: 'Broken JSON (Auto-Fix Test)',
    category: 'Edge Cases',
    description: 'Contains unquoted keys, single quotes, trailing commas, missing quotes for Auto-Fix testing',
    content: `{
  // Invalid single quotes & unquoted keys
  name: 'JSON Studio',
  version: '1.2.0',
  description: 'Fast client-side JSON editor',
  features: [
    'formatting',
    'syntax highlight',
    'auto-fix repair', // trailing comma here
  ],
  status: {
    active: true,
    rating: 4.9, // trailing comma
  },
}`
  },
  {
    id: 'geojson-cities',
    name: 'GeoJSON FeatureCollection',
    category: 'GeoJSON',
    description: 'Spatial features with Point geometry, coordinates, and properties',
    content: JSON.stringify(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [-122.4194, 37.7749]
            },
            properties: {
              name: "San Francisco",
              population: 873965,
              state: "California",
              is_capital: false
            }
          },
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [-74.006, 40.7128]
            },
            properties: {
              name: "New York City",
              population: 8336817,
              state: "New York",
              is_capital: false
            }
          },
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [139.6917, 35.6895]
            },
            properties: {
              name: "Tokyo",
              population: 13960000,
              country: "Japan",
              is_capital: true
            }
          }
        ]
      },
      null,
      2
    )
  },
  {
    id: 'ecommerce-order',
    name: 'E-Commerce Order Payload',
    category: 'E-Commerce',
    description: 'Complex order object with line items, tax breakdown, and shipping details',
    content: JSON.stringify(
      {
        order_id: "ORD-2026-88491",
        customer: {
          id: "cust_772",
          first_name: "Eleanor",
          last_name: "Vane",
          email: "e.vane@domain.org",
          tier: "VIP"
        },
        items: [
          {
            sku: "PROD-WIRELESS-HEADPHONES",
            name: "Noise-Canceling Headphones v2",
            quantity: 1,
            unit_price: 299.99,
            discounts: [{ code: "SUMMER10", amount: 30.00 }]
          },
          {
            sku: "PROD-USB-C-CABLE-2M",
            name: "Braided USB-C Cable (2m)",
            quantity: 3,
            unit_price: 14.50,
            discounts: []
          }
        ],
        summary: {
          subtotal: 343.49,
          tax: 27.48,
          shipping: 0.00,
          total: 340.97,
          currency: "USD"
        },
        shipping_address: {
          street: "742 Evergreen Terrace",
          city: "Springfield",
          state: "OR",
          postal_code: "97477",
          country: "US"
        },
        fulfilled: false,
        tracking_number: null
      },
      null,
      2
    )
  },
  {
    id: 'deeply-nested',
    name: 'Deeply Nested Tree',
    category: 'Edge Cases',
    description: 'Multi-level hierarchy to test Tree View expansion, JSONPath copy, and search filtering',
    content: JSON.stringify(
      {
        company: {
          name: "Acme Corp",
          organization: {
            division: "Engineering",
            department: {
              title: "Frontend Platform",
              teams: [
                {
                  team_name: "Core UI",
                  lead: {
                    name: "David Miller",
                    skills: ["React", "TypeScript", "CSS Architecture"],
                    projects: {
                      active: [
                        { id: "proj_101", title: "Design System Migration", progress: 0.85 },
                        { id: "proj_102", title: "JSON Studio v2", progress: 0.60 }
                      ],
                      archived: []
                    }
                  }
                }
              ]
            }
          }
        }
      },
      null,
      2
    )
  },
  {
    id: 'package-manifest',
    name: 'Package Manifest (Config)',
    category: 'Config',
    description: 'Standard package.json style configuration file',
    content: JSON.stringify(
      {
        name: "json-formatter",
        private: true,
        version: "1.2.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "tsc -b && vite build",
          lint: "eslint .",
          preview: "vite preview"
        },
        dependencies: {
          "@codemirror/lang-json": "^6.0.1",
          "@codemirror/language": "^6.10.8",
          "@codemirror/state": "^6.5.2",
          "@codemirror/view": "^6.36.3",
          "lucide-react": "^0.475.0",
          "react": "^19.0.0",
          "react-dom": "^19.0.0"
        },
        devDependencies: {
          "@types/react": "^19.0.10",
          "@types/react-dom": "^19.0.4",
          "typescript": "~5.7.2",
          "vite": "^6.1.0"
        }
      },
      null,
      2
    )
  }
];

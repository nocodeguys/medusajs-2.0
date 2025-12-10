import { 
  defineMiddlewares,
  authenticate,
} from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/me/*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
  ],
})

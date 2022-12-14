import { NextRequest, NextResponse } from 'next/server'
import Statsig from "statsig-node";
import { EdgeConfigDataAdapter } from "statsig-node-vercel"
import { EXPERIMENT, UID_COOKIE } from './lib/constants'

// We'll use this to validate a random UUID
const IS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{16}$/i

export async function middleware(req: NextRequest) {

  console.log(req.headers.get('X-Statsig-Signature'));
  console.log(req.headers.get('X-Statsig-Request-Timestamp'));
  console.log(await req.text());

  // If the request is not for `/`, continue
  if (req.nextUrl.pathname !== '/') return

  // Get the user ID from the cookie or get a new one
  let userId = req.cookies.get(UID_COOKIE)?.value
  let hasUserId = !!userId

  // If there's no active user ID in cookies or its value is invalid, get a new one
  if (!userId || !IS_UUID.test(userId)) {
    userId = crypto.randomUUID()
    hasUserId = false
  }

  const dataAdapter = new EdgeConfigDataAdapter(process.env.EDGE_CONFIG_ITEM_KEY!);
  await Statsig.initialize(
    process.env.STATSIG_SERVER_API_KEY!,
    { dataAdapter } 
  );

  const experiment = await Statsig.getExperiment({ userID: userId }, EXPERIMENT);

  const bucket = experiment.get("bucket", "Experiment not set up, please read README to set up example.")


  // Clone the URL and change its pathname to point to a bucket
  const url = req.nextUrl.clone()
  url.pathname = `/${bucket}`

  // Response that'll rewrite to the selected bucket
  const res = NextResponse.rewrite(url)

  // Add the user ID to the response cookies if it's not there or if its value was invalid
  if (!hasUserId) {
    res.cookies.set(UID_COOKIE, userId)
  }

  return res
}

import { NextRequest, NextResponse } from 'next/server';
import { useFlowStore } from '@/stores/flowStore';

export async function GET(req: NextRequest) {
  // At request time we can't read Zustand – demo only.
  return NextResponse.json({ msg: 'stub – client will POST soon' });
}


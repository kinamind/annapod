"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Eye, Construction } from "lucide-react";

export default function PreviewPage() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="p-12 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/10 mb-6">
            <Eye className="h-8 w-8 text-purple-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">场景预览</h1>
          <p className="text-muted-foreground mb-6">
            多维咨询场景可视化预览功能正在开发中。
            <br />
            您将能够提前感受不同类型来访者的咨询场景。
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Construction className="h-4 w-4" />
            Coming Soon
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
